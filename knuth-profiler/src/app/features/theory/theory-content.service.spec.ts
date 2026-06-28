import { TestBed } from '@angular/core/testing';

import { TheoryContentService } from './theory-content.service';

describe('TheoryContentService', () => {
  let service: TheoryContentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TheoryContentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
