/*
 *  Copyright 2018 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree. An additional intellectual property rights grant can be found
 *  in the file PATENTS.  All contributing project authors may
 *  be found in the AUTHORS file in the root of the source tree.
 */

#ifndef MODULES_DESKTOP_CAPTURE_TAB_CAPTURER_H_
#define MODULES_DESKTOP_CAPTURE_TAB_CAPTURER_H_

#include "api/sequence_checker.h"
#include "modules/desktop_capture/desktop_capturer.h"
#include "mozilla/MozPromise.h"
#include "nsDeque.h"
#include "nsThreadUtils.h"

namespace mozilla {
namespace dom {
struct ImageBitmapCloneData;
}  // namespace dom

class CaptureFrameRequest;
class TabCapturedHandler;
class TaskQueue;

class TabCapturerWebrtc : public webrtc::DesktopCapturer {
 private:
  ~TabCapturerWebrtc();

 public:
  friend class CaptureFrameRequest;
  friend class TabCapturedHandler;

  explicit TabCapturerWebrtc(const webrtc::DesktopCaptureOptions& options);

  static std::unique_ptr<webrtc::DesktopCapturer> CreateRawWindowCapturer(
      const webrtc::DesktopCaptureOptions& options);

  TabCapturerWebrtc(const TabCapturerWebrtc&) = delete;
  TabCapturerWebrtc& operator=(const TabCapturerWebrtc&) = delete;

  // DesktopCapturer interface.
  void Start(Callback* callback) override;
  void CaptureFrame() override;
  bool GetSourceList(SourceList* sources) override;
  bool SelectSource(SourceId id) override;
  bool FocusOnSelectedSource() override;
  bool IsOccluded(const webrtc::DesktopVector& pos) override;

 private:
  // Capture code
  using CapturePromise =
      MozPromise<UniquePtr<dom::ImageBitmapCloneData>, nsresult, true>;
  RefPtr<CapturePromise> CaptureFrameNow();

  // Helper that checks for overrun requests. Returns true if aRequest had not
  // been dropped due to disconnection or overrun.
  // Note that if this returns true, the caller takes the responsibility to call
  // mCallback with a capture result for aRequest.
  bool CompleteRequest(CaptureFrameRequest* aRequest);

  // Helper that disconnects the request, and notifies mCallback of a temporary
  // failure.
  void DisconnectRequest(CaptureFrameRequest* aRequest);

  // Handle the result from the async callback from CaptureFrameNow.
  void OnCaptureFrameSuccess(UniquePtr<dom::ImageBitmapCloneData> aData);
  void OnCaptureFrameFailure();

  const RefPtr<TaskQueue> mMainThreadWorker;
  webrtc::SequenceChecker mControlChecker;
  webrtc::SequenceChecker mCallbackChecker;
  // Set at most once in Start() to the current thread. Can then be used on
  // other threads as part of the async chain of runnables originating from
  // CaptureFrame(), since the first CaptureFrame() is guaranteed to happen
  // after setting this.
  RefPtr<TaskQueue> mCallbackWorker;
  // Set in Start() and guaranteed by the owner of this class to outlive us.
  webrtc::DesktopCapturer::Callback* mCallback
      RTC_GUARDED_BY(mCallbackChecker) = nullptr;
  // Set before Start() and not changed again.
  uint64_t mBrowserId = 0;

  // mMainThreadWorker only
  nsRefPtrDeque<CaptureFrameRequest> mRequests;
};

}  // namespace mozilla

#endif  // MODULES_DESKTOP_CAPTURE_TAB_CAPTURER_H_
