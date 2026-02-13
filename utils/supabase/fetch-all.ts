type QueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

export async function fetchAllBatches<T>(
  queryPage: (from: number, to: number) => QueryResult<T> | PromiseLike<QueryResult<T>>,
  batchSize = 1000
): Promise<T[]> {
  let from = 0
  const allRows: T[] = []

  while (true) {
    const { data, error } = await queryPage(from, from + batchSize - 1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return allRows
}
