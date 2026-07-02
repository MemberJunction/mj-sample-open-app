/**
 * @mj-sample-app/ng — the CLIENT BOOTSTRAP package.
 *
 * This is the package named in mj-app.json under packages.client with role
 * "bootstrap". When the app is installed (or dev-linked), MJExplorer's
 * auto-generated open-app-bootstrap.generated.ts gains a static
 * `import '@mj-sample-app/ng';` — ESBuild bundles it and module evaluation
 * fires the @RegisterClass decorators that make your components discoverable.
 *
 * WHAT LIVES HERE
 *   src/lib/generated/ — CodeGen Angular output (entity forms; do not edit)
 *   src/lib/           — your hand-written components (dashboards, tabs, ...)
 *
 * PATTERN (mirrors the shipped BizApps): import the entity package + the
 * generated forms so their @RegisterClass decorators fire, and RE-EXPORT the
 * generated module/components so the host's class-registration manifest can
 * import them by name.
 *
 * TODO(template): after codegen runs for YOUR entities, keep these exports in
 * sync with what src/lib/generated/ contains. Add custom components under
 * src/lib/ and export them here too (custom AFTER generated, so @RegisterClass
 * priority lets yours override).
 */

// Trigger @RegisterClass decorators for entity subclasses
import '@mj-sample-app/entities';

// Generated form components (fires their @RegisterClass decorators)
import './lib/generated/generated-forms.module';

// Re-export for consumers (the host manifest imports these by name)
export { GeneratedFormsModule } from './lib/generated/generated-forms.module';
export { sampleappSampleRecordFormComponent } from './lib/generated/Entities/sampleappSampleRecord/sampleappsamplerecord.form.component';

/**
 * Bootstrap function named by mj-app.json "startupExport" — called during
 * MJExplorer initialization. The static imports above do the actual work.
 * TODO(template): rename to Load<YourApp>Client (sync with mj-app.json).
 */
export function LoadSampleAppClient(): void {
    // Static imports ensure all classes are registered.
}
