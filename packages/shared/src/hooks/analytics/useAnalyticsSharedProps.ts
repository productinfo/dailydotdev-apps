import {
  MutableRefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { get as getCache, set as setCache } from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';
import { AnalyticsEvent } from './useAnalyticsQueue';
import FeaturesContext from '../../contexts/FeaturesContext';
import SettingsContext from '../../contexts/SettingsContext';
import AuthContext from '../../contexts/AuthContext';

const DEVICE_ID_KEY = 'device_id';

export const getOrGenerateDeviceId = async (): Promise<string> => {
  const deviceId = await getCache<string | undefined>(DEVICE_ID_KEY);
  if (deviceId) {
    return deviceId;
  }
  const newDeviceId = uuidv4();
  await setCache(DEVICE_ID_KEY, newDeviceId);
  return newDeviceId;
};

export default function useAnalyticsSharedProps(
  app: string,
  version: string,
  deviceId?: string,
): [MutableRefObject<Partial<AnalyticsEvent>>, boolean] {
  // Use ref instead of state to reduce renders
  const sharedPropsRef = useRef<Partial<AnalyticsEvent>>();
  const { query } = useRouter();
  const { flags } = useContext(FeaturesContext);
  const { themeMode, spaciness, insaneMode } = useContext(SettingsContext);
  const { visit, anonymous, tokenRefreshed, user } = useContext(AuthContext);
  const [sharedPropsSet, setSharedPropsSet] = useState(false);

  const [visitId, setVisitId] = useState<string>();
  useEffect(() => {
    // Visit ID should be set only at the beginning
    if (tokenRefreshed && !visitId) {
      setVisitId(visit?.visitId);
    }
  }, [tokenRefreshed, visit?.visitId, setVisitId, visitId]);

  useEffect(() => {
    if (!visitId) {
      return;
    }

    if (deviceId) {
      sharedPropsRef.current = {
        device_id: deviceId,
      };
    }

    const queryStr = JSON.stringify(query);
    (sharedPropsRef.current?.device_id
      ? Promise.resolve(sharedPropsRef.current.device_id)
      : getOrGenerateDeviceId()
    ).then((_deviceId) => {
      sharedPropsRef.current = {
        app_platform: app,
        app_theme: themeMode,
        app_version: version,
        feed_density: spaciness,
        feed_layout: insaneMode ? 'list' : 'cards',
        // By default query equals '{}'
        query_params: queryStr.length > 2 ? queryStr : undefined,
        session_id: visit?.sessionId,
        user_first_visit: anonymous?.firstVisit,
        user_id: anonymous?.id,
        user_referrer: anonymous?.referrer,
        user_registration_date: user?.createdAt,
        utm_campaign: query?.utm_campaign,
        utm_content: query?.utm_content,
        utm_medium: query?.utm_medium,
        utm_source: query?.utm_source,
        utm_term: query?.utm_term,
        visit_id: visitId,
        feature_flags: flags ? JSON.stringify(flags) : null,
        device_id: _deviceId,
      };
      setSharedPropsSet(true);
    });
  }, [
    sharedPropsRef,
    tokenRefreshed,
    app,
    version,
    themeMode,
    spaciness,
    insaneMode,
    query,
    visit,
    visitId,
    flags,
  ]);

  return [sharedPropsRef, sharedPropsSet];
}
