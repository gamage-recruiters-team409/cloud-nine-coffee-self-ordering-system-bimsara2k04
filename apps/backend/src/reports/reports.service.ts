import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // 1. Top KPI counts
    const [
      todayPaidOrders,
      yesterdayPaidOrders,
      inProgressOrders,
      todayCompletedOrders,
      totalAllTimeOrders,
      allStaffUsers,
      todayStatusChanges,
      allStatusChanges,
    ] = await Promise.all([
      // Today paid orders
      this.prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: todayStart },
        },
        select: { id: true, total: true, status: true },
      }),
      // Yesterday paid orders
      this.prisma.order.findMany({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
        select: { id: true, total: true },
      }),
      // In-progress orders (currently in queue)
      this.prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          status: { in: ['RECEIVED', 'PREPARING', 'READY_FOR_PICKUP'] },
        },
      }),
      // Completed orders today
      this.prisma.order.count({
        where: {
          paymentStatus: 'PAID',
          status: 'COLLECTED',
          updatedAt: { gte: todayStart },
        },
      }),
      // Total orders count
      this.prisma.order.count({
        where: { paymentStatus: 'PAID' },
      }),
      // All staff users
      this.prisma.user.findMany({
        select: { id: true, email: true, role: true },
      }),
      // Status changes today
      this.prisma.orderStatusHistory.findMany({
        where: {
          changedAt: { gte: todayStart },
          changedById: { not: null },
        },
        include: {
          changedBy: { select: { id: true, email: true, role: true } },
        },
      }),
      // Status changes all-time
      this.prisma.orderStatusHistory.findMany({
        where: {
          changedById: { not: null },
        },
        include: {
          changedBy: { select: { id: true, email: true, role: true } },
        },
      }),
    ]);

    // KPI Calculations
    const todayOrdersCount = todayPaidOrders.length;
    const todayRevenue = todayPaidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const todayAov = todayOrdersCount > 0 ? todayRevenue / todayOrdersCount : 0;

    const yesterdayOrdersCount = yesterdayPaidOrders.length;
    const yesterdayRevenue = yesterdayPaidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const yesterdayAov = yesterdayOrdersCount > 0 ? yesterdayRevenue / yesterdayOrdersCount : 0;

    const revenueDiff = todayRevenue - yesterdayRevenue;
    const revenueChangePercent =
      yesterdayRevenue > 0
        ? Number(((revenueDiff / yesterdayRevenue) * 100).toFixed(1))
        : todayRevenue > 0
          ? 100
          : 0;

    const ordersDiff = todayOrdersCount - yesterdayOrdersCount;
    const ordersChangePercent =
      yesterdayOrdersCount > 0
        ? Number(((ordersDiff / yesterdayOrdersCount) * 100).toFixed(1))
        : todayOrdersCount > 0
          ? 100
          : 0;

    const aovDiff = todayAov - yesterdayAov;
    const aovChangePercent =
      yesterdayAov > 0
        ? Number(((aovDiff / yesterdayAov) * 100).toFixed(1))
        : todayAov > 0
          ? 100
          : 0;

    // 2. 7-Day Trend Breakdown
    const past7Days = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dEnd = new Date(dStart.getTime() + 24 * 60 * 60 * 1000);
      const dayName = dStart.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      past7Days.push({
        dayName,
        dStart,
        dEnd,
      });
    }

    const past7DaysOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: past7Days[0].dStart },
      },
      select: { createdAt: true, total: true },
    });

    const trendData = past7Days.map(({ dayName, dStart, dEnd }) => {
      const dayOrders = past7DaysOrders.filter(
        (o) => o.createdAt >= dStart && o.createdAt < dEnd,
      );
      const dayRev = dayOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const count = dayOrders.length;
      const aov = count > 0 ? dayRev / count : 0;
      return {
        date: dayName,
        revenue: Number(dayRev.toFixed(2)),
        orderCount: count,
        aov: Number(aov.toFixed(2)),
      };
    });

    // 3. Staff Responsibility & Performance Breakdown
    const staffMap = new Map<
      string,
      {
        id: string;
        email: string;
        role: string;
        todayPreparing: number;
        todayReady: number;
        todayCompleted: number;
        todayTotalHandled: number;
        allTimeHandled: number;
      }
    >();

    // Initialize all known staff
    allStaffUsers.forEach((user) => {
      staffMap.set(user.id, {
        id: user.id,
        email: user.email,
        role: user.role,
        todayPreparing: 0,
        todayReady: 0,
        todayCompleted: 0,
        todayTotalHandled: 0,
        allTimeHandled: 0,
      });
    });

    // Aggregate today changes
    todayStatusChanges.forEach((change) => {
      if (!change.changedById) return;
      const record = staffMap.get(change.changedById) || {
        id: change.changedById,
        email: change.changedBy?.email || 'Unknown',
        role: change.changedBy?.role || 'BARISTA',
        todayPreparing: 0,
        todayReady: 0,
        todayCompleted: 0,
        todayTotalHandled: 0,
        allTimeHandled: 0,
      };

      if (change.status === 'PREPARING') record.todayPreparing++;
      if (change.status === 'READY_FOR_PICKUP') record.todayReady++;
      if (change.status === 'COLLECTED') record.todayCompleted++;
      record.todayTotalHandled++;
      staffMap.set(change.changedById, record);
    });

    // Aggregate all-time changes
    allStatusChanges.forEach((change) => {
      if (!change.changedById) return;
      const record = staffMap.get(change.changedById);
      if (record) {
        record.allTimeHandled++;
      }
    });

    const staffPerformance = Array.from(staffMap.values()).filter(
      (s) => s.role === 'BARISTA' || s.todayTotalHandled > 0 || s.allTimeHandled > 0,
    );

    // 4. Popular drinks
    const popularDrinks = await this.prisma.orderItem.groupBy({
      by: ['drinkId', 'drinkName'],
      _sum: { quantity: true },
      orderBy: {
        _sum: { quantity: 'desc' },
      },
      take: 6,
    });

    // 5. Recent Activity Orders (latest 15)
    const recentOrders = await this.prisma.order.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });

    const formattedRecentOrders = recentOrders.map((order) => {
      const latestStaffChange = order.statusHistory.find((sh) => sh.changedBy);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName || 'Guest',
        diningOption: order.diningOption,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        status: order.status,
        total: Number(order.total),
        itemsSummary: order.items
          .map((i) => `${i.quantity}x ${i.drinkName}`)
          .join(', '),
        itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
        responsibleStaff: latestStaffChange?.changedBy?.email || 'System / Auto',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    return {
      kpi: {
        totalOrdersToday: todayOrdersCount,
        totalRevenueToday: Number(todayRevenue.toFixed(2)),
        averageOrderValueToday: Number(todayAov.toFixed(2)),
        ordersInProgress: inProgressOrders,
        completedOrdersToday: todayCompletedOrders,
        totalAllTimeOrders,
      },
      comparisons: {
        revenue: {
          today: Number(todayRevenue.toFixed(2)),
          yesterday: Number(yesterdayRevenue.toFixed(2)),
          diff: Number(revenueDiff.toFixed(2)),
          percentChange: revenueChangePercent,
        },
        orderCount: {
          today: todayOrdersCount,
          yesterday: yesterdayOrdersCount,
          diff: ordersDiff,
          percentChange: ordersChangePercent,
        },
        averageOrderValue: {
          today: Number(todayAov.toFixed(2)),
          yesterday: Number(yesterdayAov.toFixed(2)),
          diff: Number(aovDiff.toFixed(2)),
          percentChange: aovChangePercent,
        },
      },
      trends: trendData,
      staffPerformance,
      popularDrinks: popularDrinks.map((pd) => ({
        drinkId: pd.drinkId,
        drinkName: pd.drinkName,
        totalQuantity: pd._sum.quantity || 0,
      })),
      recentOrders: formattedRecentOrders,
    };
  }

  async getSummary() {
    return this.getDashboardMetrics();
  }

  async getRecentOrders(limit: number = 20) {
    return this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            modifiers: true,
          },
        },
        statusHistory: {
          include: {
            changedBy: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
      },
    });
  }
}
