import { useEffect, useRef } from 'react';

const useInfiniteScroll = (
  onLoadMore: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean
) => {
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin: '100px', threshold: 0 }
    );

    observer.observe(loader);
    return () => observer.unobserve(loader);
  }, [hasNextPage, isFetchingNextPage]);

  return loaderRef;
};

export default useInfiniteScroll;
