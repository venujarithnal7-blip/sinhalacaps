const progressMap = new Map();

export function setProgress(id, value) {
  progressMap.set(id, value);
}

export function getProgress(id) {
  return progressMap.get(id) || 0;
}

export function deleteProgress(id) {
  progressMap.delete(id);
}