import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateDrinkDto } from './update-drink.dto';

/**
 * Guards the availability toggle specifically.
 *
 * The admin Hide/Show button sends `{ isAvailable }` and nothing else, so every
 * other field arrives as undefined. Without @IsOptional() on price, the
 * validator rejected the *absent* field and the toggle returned 400 for every
 * click. Service-level tests cannot catch this because they call the service
 * directly and bypass validation entirely, so it is asserted here against the
 * same class-validator rules the global ValidationPipe applies.
 */
describe('UpdateDrinkDto validation', () => {
  const errorsFor = async (payload: Record<string, unknown>) =>
    validate(plainToInstance(UpdateDrinkDto, payload));

  const messagesFor = (errors: Awaited<ReturnType<typeof errorsFor>>) =>
    errors.flatMap((e) => Object.values(e.constraints ?? {}));

  it('accepts an availability-only toggle', async () => {
    const errors = await errorsFor({ isAvailable: false });

    expect(messagesFor(errors)).toEqual([]);
    expect(errors).toHaveLength(0);
  });

  it('accepts a price-only update', async () => {
    expect(messagesFor(await errorsFor({ price: 640 }))).toEqual([]);
  });

  it('accepts a name-only update', async () => {
    expect(messagesFor(await errorsFor({ name: 'Iced Latte' }))).toEqual([]);
  });

  it('accepts a description-only update', async () => {
    expect(messagesFor(await errorsFor({ description: 'Now with oat milk' }))).toEqual([]);
  });

  it('accepts a sortOrder-only update', async () => {
    expect(messagesFor(await errorsFor({ sortOrder: 3 }))).toEqual([]);
  });

  it('still rejects an invalid price when one is supplied', async () => {
    expect(messagesFor(await errorsFor({ price: -5 }))).toContain(
      'price must not be less than 0',
    );
  });

  it('still rejects an out-of-range price', async () => {
    expect(messagesFor(await errorsFor({ price: 100000000 }))).toContain(
      'price must not be greater than 99999999.99',
    );
  });

  it('still rejects a non-numeric price', async () => {
    expect(messagesFor(await errorsFor({ price: 'abc' })).length).toBeGreaterThan(0);
  });

  it('still rejects a non-boolean availability flag', async () => {
    expect(messagesFor(await errorsFor({ isAvailable: 'yes' }))).toContain(
      'isAvailable must be a boolean value',
    );
  });

  it('still rejects a too-short name', async () => {
    expect(messagesFor(await errorsFor({ name: 'a' })).length).toBeGreaterThan(0);
  });
});