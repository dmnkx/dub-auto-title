/**
 * @param {{ titles?: string[] }[]} batch
 */
export function countTitlesInBatch(batch) {
  return batch.reduce(
    (sum, { titles }) => sum + (Array.isArray(titles) ? titles.length : 0),
    0
  );
}
