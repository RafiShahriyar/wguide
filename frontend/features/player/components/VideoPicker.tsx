// frontend/features/player/components/VideoPicker.tsx

"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useRedux";
import { videoOpened } from "@/features/player/playerSlice";
import { selectPlayer } from "@/features/player/playerSelectors";

export function VideoPicker() {
  const dispatch = useAppDispatch();
  const { pickRequest, sourceUrl } = useAppSelector(selectPlayer);
  const inputRef = useRef<HTMLInputElement>(null);

  // React to the "open the dialog" signal. The menu bar (and the empty-state
  // button) only bump pickRequest — THIS component is the single owner of the
  // real <input> element.
  useEffect(() => {
    if (pickRequest > 0) {
      inputRef.current?.click();
    }
  }, [pickRequest]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Side effects happen here (component land), NOT in the reducer: free the
    // previous object URL before handing over the new one.
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    const url = URL.createObjectURL(file);
    dispatch(videoOpened({ fileName: file.name, sourceUrl: url }));

    // Reset the input so choosing the SAME file again still fires onChange.
    event.target.value = "";
  }

  return (
    <input
      ref={inputRef}
      type="file"
      accept="video/*"
      className="hidden"
      onChange={onFileChange}
    />
  );
}
