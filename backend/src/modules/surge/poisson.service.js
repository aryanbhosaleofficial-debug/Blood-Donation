'use strict';

/**
 * modules/surge/poisson.service
 *
 * Numerically stable Poisson helpers for the surge detector.
 *
 * The detector models request arrivals in a fixed window as
 *   X ~ Poisson(lambda)
 * and asks: how surprising is it to observe `k` or more requests?
 *
 * `poissonUpperTail(k, lambda) = P(X >= k)` — the "upper-tail probability".
 * It is NOT a probability of a disaster; it is only the probability of seeing
 * at least this much demand under the configured baseline model.
 *
 * All functions are pure and deterministic.
 */

/**
 * P(X = i) for X ~ Poisson(lambda), computed iteratively to avoid factorials.
 * @param {number} i
 * @param {number} lambda
 * @returns {number}
 */
function poissonPmf(i, lambda) {
  if (!Number.isFinite(i) || !Number.isFinite(lambda) || lambda < 0) return NaN;
  const k = Math.floor(i);
  if (k < 0) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  // pmf(0) = e^-lambda ; pmf(m) = pmf(m-1) * lambda / m
  let term = Math.exp(-lambda);
  for (let m = 1; m <= k; m += 1) {
    term = (term * lambda) / m;
  }
  return term;
}

/**
 * P(X >= k) for X ~ Poisson(lambda).
 *
 * Edge cases (deterministic):
 *   k <= 0                -> 1   (observing "0 or more" is certain)
 *   lambda === 0, k >= 1  -> 0   (a zero-rate process never produces events)
 *   invalid / NaN / <0    -> NaN (caller treats NaN as "no statistical signal")
 *
 * @param {number} k       observed count
 * @param {number} lambda  expected count for the window
 * @returns {number} probability in [0, 1], or NaN for invalid input
 */
function poissonUpperTail(k, lambda) {
  if (!Number.isFinite(k) || !Number.isFinite(lambda) || lambda < 0) return NaN;
  const target = Math.ceil(k);
  // Counts are non-negative, so P(X >= k) is 1 for any k <= 0.
  if (target <= 0) return 1;
  if (lambda === 0) return 0;

  // P(X >= k) = 1 - P(X <= k-1) = 1 - sum_{i=0}^{k-1} pmf(i)
  // Sum forward with the pmf recurrence for stability at small lambda.
  let term = Math.exp(-lambda); // pmf(0)
  let cdf = term;
  for (let i = 1; i <= target - 1; i += 1) {
    term = (term * lambda) / i;
    cdf += term;
  }
  const tail = 1 - cdf;
  // Clamp tiny negative/over-one drift from floating point.
  if (tail <= 0) return 0;
  if (tail >= 1) return 1;
  return tail;
}

module.exports = { poissonPmf, poissonUpperTail };
