/**
 * 前後端共用契約。新增功能切片時，第一步就是在這裡加 schema。
 * API 用它驗證輸入（@hono/zod-validator），Web 用它推型別與驗證回應。
 */
export * from './places';
export * from './opendata';
export * from './health';
export * from './newapp';
