function getScriptUrl() {
  const params = new URL(location.href).searchParams;
  let scriptUrl = params.get("script");
  if (params.has("orbEnabled")) {
    scriptUrl += "&orbEnabled";
  }
  return scriptUrl;
}

// Hold the nested worker alive until this parent worker closes.
var worker;

addEventListener("message", function nestedWorkerWrapperOnMessage(evt) {
  removeEventListener("message", nestedWorkerWrapperOnMessage);

  worker = new Worker("worker_wrapper.js?script=" + getScriptUrl());

  worker.addEventListener("message", function(evt) {
    self.postMessage({
      context: "NestedWorker",
      type: evt.data.type,
      status: evt.data.status,
      msg: evt.data.msg,
    });
  });

  worker.addEventListener("error", function(evt) {
    self.postMessage({
      context: "NestedWorker",
      type: "status",
      status: false,
      msg: "Nested worker error: " + evt.message,
    });
  });

  worker.postMessage(evt.data);
});
