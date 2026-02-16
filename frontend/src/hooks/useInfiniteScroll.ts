import { useEffect, useRef, type RefObject } from 'react';

const useInfiniteScroll = (
  onLoadMore: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  scrollRootRef?: RefObject<HTMLElement | null>
) => {
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const loader = loaderRef.current;
    const scrollRoot = scrollRootRef?.current ?? null;
    if (!loader) return;

    if (scrollRootRef && !scrollRoot) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          onLoadMoreRef.current();
        }
      },
      {
        root: scrollRoot ?? undefined,
        rootMargin: '300px',
        threshold: 0,
      }
    );

    observer.observe(loader);
    return () => observer.unobserve(loader);
  }, [hasNextPage, isFetchingNextPage, scrollRootRef]);

  return loaderRef;
};

export default useInfiniteScroll;
