import { Routes } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { ExamplesPageComponent } from './pages/examples-page/examples-page.component';
import { TheoryWizardComponent } from './pages/theory-wizard/theory-wizard.component';
import { CfgImportPageComponent } from './pages/cfg-import-page/cfg-import-page.component';

export const routes: Routes = [
    { path: '', title: "Почетна", component: HomePageComponent},
    { path: 'primeri', title: "Примери", component: ExamplesPageComponent },
    { path: 'teorija', title: "Теорија", component: TheoryWizardComponent },
    { path: 'cfg-import', title: 'CFG Import', component: CfgImportPageComponent },
    { path: '**', redirectTo: '' }
];
