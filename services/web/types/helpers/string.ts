import { Brand } from './brand'

/**
 * A branded type representing a string that is guaranteed to be non-empty.
 * This is a compile-time-only type and does not add any runtime overhead.
 * It's created using a type guard and is a safer alternative to a simple `string`
 * when you need to ensure the value is not an empty string ('').
 *
 * The compiler will prevent a regular `string` or an empty string literal
 * from being assigned to this type without a type assertion. The recommended way
 * to create an instance of this type is by using the {@link isNonEmptyString}
 * type guard.
 *
 * @example
 * // A function that requires a non-empty string as input
 * function greetUser(name: NonEmptyString): void {
 *   console.log(`Hello, ${name}!`);
 * }
 *
 * // Use the type guard to safely call the function
 * if (isNonEmptyString("Alice")) {
 *   greetUser(userInput); // This call is valid
 * } else {
 *   console.error("Error: User name cannot be empty.");
 * }
 */
export type NonEmptyString = Brand<string, 'NonEmptyString'>

/**
 * A type guard to check if a string is non-empty.
 *
 * This function performs a runtime check and, if the condition is met,
 * tells the TypeScript compiler to treat the string as a {@link NonEmptyString}.
 * This is the only way to safely transition from a `string` to a `NonEmptyString`
 * type without a type assertion.
 *
 * @param {string} str - The string to check.
 * @returns {str is NonEmptyString} - A boolean indicating if the string is non-empty.
 */
export function isNonEmptyString(str: string): str is NonEmptyString {
  return str.length > 0
}
