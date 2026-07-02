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
 * EXAMPLE — a resource component that renders as a tab in MJ Explorer
 * (uncomment once @memberjunction/ng-shared is available in your workspace;
 * its DriverClass name must match a DefaultNavItems entry in your
 * application metadata — see metadata/_examples/):
 *
 *   import { Component } from '@angular/core';
 *   import { RegisterClass } from '@memberjunction/global';
 *   import { BaseResourceComponent, ResourceData } from '@memberjunction/ng-shared';
 *
 *   @RegisterClass(BaseResourceComponent, 'SampleAppDashboard')
 *   @Component({
 *     selector: 'sample-app-dashboard',
 *     template: '<div><h2>Sample App</h2></div>',
 *     standalone: false
 *   })
 *   export class SampleAppDashboardComponent extends BaseResourceComponent {
 *     async GetResourceDisplayName(data: ResourceData): Promise<string> { return 'Sample App'; }
 *     async GetResourceIconClass(data: ResourceData): Promise<string> { return 'fa-solid fa-cube'; }
 *   }
 *
 * TODO(template): rename the function to Load<YourApp>Client and keep it in
 * sync with mj-app.json "startupExport".
 */
export function LoadSampleAppClient(): void {
    // No-op: importing this module registers the components above.
}
