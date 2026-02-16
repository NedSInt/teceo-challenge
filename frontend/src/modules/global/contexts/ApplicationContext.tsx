/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LoadingStatus } from '../enums/LoadingStatus.enum';
import type { HandleLoadingStatusProps } from '../interfaces/applicationContext.interfaces';

export interface ApplicationContextProps {
  search: string;
  onChangeSearch: (newSearch: string) => void;
  handleLoadingStatus: <T>(
    props: HandleLoadingStatusProps<T>,
  ) => Promise<T>;
  loadingStatus: LoadingStatus;
}

const defaultFn = () => {};

const defaultContextValue: ApplicationContextProps = {
  search: '',
  onChangeSearch: defaultFn,
  handleLoadingStatus: defaultFn as unknown as ApplicationContextProps['handleLoadingStatus'],
  loadingStatus: LoadingStatus.SUCCESS,
};

const ApplicationContext =
  createContext<ApplicationContextProps>(defaultContextValue);

interface ApplicationContextProviderProps {
  children: React.ReactNode;
}

export const ApplicationContextProvider = ({
  children,
}: ApplicationContextProviderProps) => {
  const [loadingStatus, setLoadingStatus] = useState(LoadingStatus.SUCCESS);
  const [search, setSearch] = useState('');

  const handleLoadingStatus = useCallback(async <T,>({
    requestFn,
    onSuccess,
    disabled,
  }: HandleLoadingStatusProps<T>) => {
    if (disabled) {
      return requestFn();
    }

    setLoadingStatus(LoadingStatus.LOADING);
    const response = await requestFn();
    setLoadingStatus(LoadingStatus.SUCCESS);

    if (onSuccess) {
      onSuccess();
    }
    return response;
  }, []);

  const value = useMemo(
    () => ({
      search,
      onChangeSearch: setSearch,
      handleLoadingStatus,
      loadingStatus,
    }),
    [search, handleLoadingStatus, loadingStatus],
  );

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplicationContext = () =>
  useContext<ApplicationContextProps>(ApplicationContext);
