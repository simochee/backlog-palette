export type SpaceId = string;
export type ProjectId = string;
export type CommandId = string;

export type StackSegment =
  | { kind: 'space'; spaceId: SpaceId; label: string }
  | { kind: 'project'; projectId: ProjectId; label: string }
  | { kind: 'command'; commandId: CommandId; label: string }
  | { kind: 'commandArg'; value: string; label: string };

export type SegmentKind = StackSegment['kind'];

/**
 * パレットの階層状態。左から右へ積み、右端が「今いる階層」。
 * 積む／右端を外す以外の操作を持たない（docs/implementation-plan.md §4）。
 */
export type Stack = {
  readonly segments: readonly StackSegment[];
  /** ⌫ の 1 回目で立ち、右端に取り消し線が付く。2 回目で実際に外れる */
  readonly armedForDelete: boolean;
};

export type Scope =
  | { kind: 'allSpaces' }
  | { kind: 'space'; spaceId: SpaceId }
  | { kind: 'project'; spaceId: SpaceId; projectId: ProjectId };

export type ActiveCommand = {
  commandId: CommandId;
  label: string;
  args: readonly string[];
};
