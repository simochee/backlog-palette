export {
  type BacklogClient,
  type ClientOptions,
  createClient,
  type SpaceCredential,
} from './client.ts';
export {
  type BacklogErrorKind,
  type BacklogFailure,
  BacklogRequestError,
  failureFromCause,
  failureFromStatus,
  isBacklogRequestError,
  spaceKeyFromHost,
} from './errors.ts';
export {
  type ApiRateLimit,
  DEFAULT_MAX_WAIT_MS,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitBucket,
  type RateLimitSnapshot,
} from './rateLimit.ts';
export type {
  BacklogDocument,
  BacklogIssue,
  BacklogProject,
  BacklogStatus,
  BacklogWiki,
  DocumentSearchParams,
  IssueSearchParams,
  QueryParams,
  WikiSearchParams,
} from './types.ts';
