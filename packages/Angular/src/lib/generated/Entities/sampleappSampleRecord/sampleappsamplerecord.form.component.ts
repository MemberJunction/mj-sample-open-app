import { Component } from '@angular/core';
import { sampleappSampleRecordEntity } from '@mj-sample-app/entities';
import { RegisterClass } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';

@RegisterClass(BaseFormComponent, 'Sample App: Sample Records') // Tell MemberJunction about this class
@Component({
    standalone: false,
    selector: 'gen-sampleappsamplerecord-form',
    templateUrl: './sampleappsamplerecord.form.component.html'
})
export class sampleappSampleRecordFormComponent extends BaseFormComponent {
    public record!: sampleappSampleRecordEntity;

    override async ngOnInit() {
        await super.ngOnInit();
        this.initSections([
            { sectionKey: 'details', sectionName: 'Details', isExpanded: true }
        ]);
    }
}

