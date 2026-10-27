export const CATEGORY_SCOPES = ['PRODUCT', 'SCIENCE', 'COURSE'] as const;
export type CategoryScope = typeof CATEGORY_SCOPES[number];

/** Used in content queries with the fixed content alias `c`. */
export const CONTENT_SCOPE_SQL = "CASE WHEN c.kind IN ('ARTICLE_COURSE','VIDEO_COURSE') THEN 'COURSE' ELSE 'SCIENCE' END";
