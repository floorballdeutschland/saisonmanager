/**
 * Server-Entry-Point für SSR/Prerendering (SSG).
 *
 * `@angular/ssr` erkennt den Default-Export als NgModule und bootstrappt ihn
 * über `platformServer().bootstrapModule()`.
 */
export { AppServerModule as default } from './app/app.server.module';
