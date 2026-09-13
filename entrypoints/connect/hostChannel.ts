import { isKnownSpaceOrigin } from '@/lib/backlog/spaceOrigins';
import { createHostChannel } from '@/lib/messaging/hostChannel';

export const hostChannel = createHostChannel(window, isKnownSpaceOrigin);
