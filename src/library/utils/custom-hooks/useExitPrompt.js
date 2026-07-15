import { useEffect } from "react";

export default function useExitPrompt(shouldBlock = true, message = "You have unsaved changes. Leave editor?") {
  useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    const handlePopState = () => {
      const confirmed = window.confirm(message);
      if (!confirmed) {
        window.history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    window.history.pushState(null, "", window.location.href);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [shouldBlock, message]);
}