/**
 * PayHere server-to-server notify payload.
 *
 * Intentionally NOT a class-validator DTO: the global ValidationPipe runs with
 * `forbidNonWhitelisted: true`, and PayHere sends a fixed set of fields we do
 * not need to declare. An unvalidated raw body avoids rejecting live callbacks.
 * Everything is validated explicitly in PaymentsService.handleNotify() instead.
 */
export interface PayHereNotifyPayload {
  merchant_id?: string;
  order_id?: string;
  payhere_amount?: string;
  payhere_currency?: string;
  status_code?: string;
  md5sig?: string;

  payment_id?: string;
  method?: string;
  payment_method?: string;
  card_type?: string;
  card_no?: string;
  card_expiry?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  buyer_ip?: string;
  recurrence_id?: string;
  installment_no?: string;
}
