// |reftest| skip -- Temporal is not supported
// Copyright (C) 2022 Igalia, S.L. All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-get-temporal.plainyearmonth.prototype.inleapyear
description: Validate result returned from calendar inLeapYear() method
features: [Temporal]
---*/

const badResults = [
  [undefined, TypeError],
  [null, TypeError],
  [0, TypeError],
  [-0, TypeError],
  [42, TypeError],
  [7.1, TypeError],
  [NaN, TypeError],
  [Infinity, TypeError],
  [-Infinity, TypeError],
  ["", TypeError],
  ["a string", TypeError],
  ["0", TypeError],
  [Symbol("foo"), TypeError],
  [0n, TypeError],
  [42n, TypeError],
  [{}, TypeError],
  [{valueOf() { return false; }}, TypeError],
];

badResults.forEach(([result, error]) => {
  const calendar = new class extends Temporal.Calendar {
    inLeapYear() {
      return result;
    }
  }("iso8601");
  const instance = new Temporal.PlainYearMonth(1981, 12, calendar);
  assert.throws(error, () => instance.inLeapYear, `${typeof result} ${String(result)} not converted to boolean`);
});

const preservedResults = [
  true,
  false,
];

preservedResults.forEach(result => {
  const calendar = new class extends Temporal.Calendar {
    inLeapYear() {
      return result;
    }
  }("iso8601");
  const instance = new Temporal.PlainYearMonth(1981, 12, calendar);
  assert.sameValue(instance.inLeapYear, result, `${typeof result} ${String(result)} preserved`);
});

reportCompare(0, 0);
