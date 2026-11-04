/**
 * Well-formed ids that do not exist in any workspace, for 404 / 403 probes.
 * Shapes follow the live API: deal and team ids are 12 hex chars, node and screening ids are integers.
 */
export const UNKNOWN_DEAL_ID = '000000000000';
export const UNKNOWN_NODE_ID = 999_999_999_999;
export const UNKNOWN_SCREENING_ID = 999_999_999;
export const FOREIGN_TEAM_ID = '000000000000';
export const UNKNOWN_API_KEY_ID = '00000000-0000-0000-0000-000000000000';
