/* Any copyright is dedicated to the Public Domain.
 * https://creativecommons.org/publicdomain/zero/1.0/ */

add_task(async function() {
  let select = document.createElement("select");
  select.appendChild(new Option("abc"));
  select.appendChild(new Option("defg"));
  registerCleanupFunction(() => select.remove());
  document.body.appendChild(select);
  let popupShownPromise = BrowserTestUtils.waitForSelectPopupShown(window);
  EventUtils.synthesizeMouseAtCenter(select, {});

  let popup = await popupShownPromise;
  ok(!!popup, "Should've shown the popup");
  let items = popup.querySelectorAll("menuitem");
  is(items.length, 2, "Should have two options");
  is(items[0].textContent, "abc", "First option should be correct");
  is(items[1].textContent, "defg", "First option should be correct");
});
