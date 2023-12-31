/* Copyright 2018 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PdfStreamConverter: "resource://pdf.js/PdfStreamConverter.sys.mjs",
});

// Register/unregister a constructor as a factory.
export function StreamConverterFactory() {
  if (!Services.prefs.getBoolPref("pdfjs.disabled", false)) {
    return new lazy.PdfStreamConverter();
  }
  throw Components.Exception("", Cr.NS_ERROR_FACTORY_NOT_REGISTERED);
}
