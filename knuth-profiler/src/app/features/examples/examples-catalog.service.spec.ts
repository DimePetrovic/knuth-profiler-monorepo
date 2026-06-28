import { TestBed } from '@angular/core/testing';

import { ExamplesCatalogService } from './examples-catalog.service';

describe('ExamplesCatalogService', () => {
  let service: ExamplesCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExamplesCatalogService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
