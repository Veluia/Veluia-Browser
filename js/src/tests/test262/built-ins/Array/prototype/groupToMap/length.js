// |reftest| shell-option(--enable-array-grouping) skip-if(!Array.prototype.group||!xulRuntime.shell) -- array-grouping is not enabled unconditionally, requires shell-options

// Copyright (c) 2021 Ecma International.  All rights reserved.
// This code is governed by the BSD license found in the LICENSE file.

/*---
esid: sec-array.prototype.groupToMap
description: Array.prototype.groupToMap property length descriptor
info: |
  22.1.3.15 Array.prototype.groupToMap ( callbackfn [ , thisArg ] )

  ...

    17 ECMAScript Standard Built-in Objects

  ...

includes: [propertyHelper.js]
features: [array-grouping]
---*/

verifyProperty(Array.prototype.groupToMap, "length", {
  value: 1,
  enumerable: false,
  writable: false,
  configurable: true
});

reportCompare(0, 0);
