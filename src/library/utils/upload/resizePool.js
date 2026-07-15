/**
 * resizePool.js
 * ─────────────────────────────────────────────────────────────────
 * Bounded pool of resize workers.
 *
 * Why a separate pool: network concurrency (how many images upload
 * at once) and CPU concurrency (how many images decode + encode at
 * once) have very different sweet spots. Uploads are I/O-bound and
 * tolerate 4-6 in flight; decoding a 20-30 MB photo costs ~200 MB
 * of transient RAM and seconds of CPU, so more than 2 at a time
 * stalls even strong machines. All resize requests funnel through
 * this pool — extra requests simply queue.
 *
 * Fallback: if Workers can't be spawned, or this browser's workers
 * lack OffscreenCanvas (Safari < 16.4), jobs run on the main thread
 * one at a time (the pre-worker behavior, but with concurrency 1).
 * ─────────────────────────────────────────────────────────────────
 */
import { resizeImage } from "./imageResizer";

const POOL_SIZE = Math.min(
  2,
  Math.max(
    1,
    (typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4) - 2
  )
);

let fallbackToMainThread = typeof Worker === "undefined";
let mainThreadLoopRunning = false;

const allWorkers = []; // { worker, job }
const idleWorkers = [];
const waitingJobs = []; // { file, outputType, quality, thumbMaxDim, onThumb, resolve, reject }

function spawnWorker() {
  let worker;
  try {
    worker = new Worker(new URL("./resize.worker.js", import.meta.url));
  } catch (err) {
    fallbackToMainThread = true;
    return null;
  }

  const slot = { worker, job: null };

  worker.onmessage = (event) => {
    const { type, result, thumb, dims, error, unsupported } = event.data || {};
    const job = slot.job;
    if (!job) return;

    if (type === "thumb") {
      try {
        job.onThumb?.(thumb, dims);
      } catch {
        /* preview callback must never break the pipeline */
      }
      return;
    }

    slot.job = null;

    if (type === "done") {
      job.resolve(result);
      idleWorkers.push(slot);
    } else if (unsupported) {
      // This browser's workers can't resize — retry the job on the
      // main thread and stop using workers altogether.
      fallbackToMainThread = true;
      waitingJobs.unshift(job);
      teardownWorkers();
    } else {
      job.reject(new Error(error || "Image resize failed"));
      idleWorkers.push(slot);
    }
    pump();
  };

  worker.onerror = (event) => {
    // Worker crashed (e.g. OOM on a corrupt/huge image). Fail just this
    // job — the upload manager degrades to its legacy upload fallback.
    if (event?.preventDefault) event.preventDefault();
    const job = slot.job;
    slot.job = null;
    try {
      worker.terminate();
    } catch {
      /* ignore */
    }
    const index = allWorkers.indexOf(slot);
    if (index >= 0) allWorkers.splice(index, 1);
    const idleIndex = idleWorkers.indexOf(slot);
    if (idleIndex >= 0) idleWorkers.splice(idleIndex, 1);
    if (job) job.reject(new Error("Image resize worker crashed"));
    pump();
  };

  allWorkers.push(slot);
  return slot;
}

function teardownWorkers() {
  for (const slot of allWorkers) {
    // Re-queue any job still running on another worker so it isn't
    // stranded by terminate().
    if (slot.job) {
      waitingJobs.push(slot.job);
      slot.job = null;
    }
    try {
      slot.worker.terminate();
    } catch {
      /* ignore */
    }
  }
  allWorkers.length = 0;
  idleWorkers.length = 0;
}

async function runMainThreadLoop() {
  if (mainThreadLoopRunning) return;
  mainThreadLoopRunning = true;
  while (waitingJobs.length > 0) {
    const job = waitingJobs.shift();
    try {
      const result = await resizeImage(job.file, job.outputType, job.quality, {
        thumbMaxDim: job.thumbMaxDim,
        onThumb: job.onThumb,
      });
      job.resolve(result);
    } catch (err) {
      job.reject(err);
    }
  }
  mainThreadLoopRunning = false;
}

function pump() {
  if (fallbackToMainThread) {
    if (waitingJobs.length > 0) runMainThreadLoop();
    return;
  }

  while (waitingJobs.length > 0) {
    let slot = idleWorkers.pop();
    if (!slot && allWorkers.length < POOL_SIZE) {
      slot = spawnWorker();
      if (fallbackToMainThread) {
        pump(); // re-enter via the fallback branch
        return;
      }
    }
    if (!slot) return; // every worker busy — job stays queued

    const job = waitingJobs.shift();
    slot.job = job;
    slot.worker.postMessage({
      file: job.file,
      outputType: job.outputType,
      quality: job.quality,
      thumbMaxDim: job.thumbMaxDim,
    });
  }
}

/**
 * Resize an image off the main thread (queued, bounded concurrency).
 * Same result shape as resizeImage().
 *
 * @param {File} file
 * @param {object} [options]
 * @param {string}   [options.outputType]
 * @param {number}   [options.quality]
 * @param {number}   [options.thumbMaxDim]
 * @param {Function} [options.onThumb] – early thumbnail callback
 * @returns {Promise<{large, medium, small, thumb, width, height, mimeType}>}
 */
export function resizeImageInPool(file, options = {}) {
  return new Promise((resolve, reject) => {
    waitingJobs.push({
      file,
      outputType: options.outputType,
      quality: options.quality,
      thumbMaxDim: options.thumbMaxDim,
      onThumb: options.onThumb,
      resolve,
      reject,
    });
    pump();
  });
}

export default resizeImageInPool;
