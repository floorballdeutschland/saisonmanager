import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import {
  getTranslocoTestingModule,
  NotificationService,
  RefereeCourseService,
  RefereeService,
} from '@floorball/core';
import { CourseLeadsComponent } from './course-leads.component';

describe('CourseLeadsComponent', () => {
  function render() {
    const service = jasmine.createSpyObj('RefereeCourseService', [
      'addLead',
      'removeLead',
      'setMainLead',
    ]);
    service.addLead.and.returnValue(
      of({
        id: 1,
        user_id: 2,
        name: 'Jörg Müller',
        user_name: 'kl-mueller',
        lead: false,
        invited: true,
      })
    );
    const notify = jasmine.createSpyObj('NotificationService', ['success']);
    TestBed.configureTestingModule({
      imports: [FormsModule, getTranslocoTestingModule()],
      declarations: [CourseLeadsComponent],
      providers: [
        { provide: RefereeCourseService, useValue: service },
        {
          provide: RefereeService,
          useValue: jasmine.createSpyObj('RefereeService', ['adminGetAll']),
        },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(CourseLeadsComponent);
    fixture.componentRef.setInput('courseId', 7);
    fixture.detectChanges();
    return { fixture, service, notify };
  }

  it('laedt eine neue Person erst mit gueltiger Adresse ein', () => {
    const { fixture, service, notify } = render();
    const c = fixture.componentInstance;
    let changed = 0;
    c.changed.subscribe(() => changed++);

    c.open('new');
    c.firstName = 'Jörg';
    c.lastName = 'Müller';
    c.email = 'joerg@';
    expect(c.newValid).toBeFalse();
    c.email = ' joerg@example.org ';
    c.addNew();

    expect(service.addLead).toHaveBeenCalledWith(7, {
      first_name: 'Jörg',
      last_name: 'Müller',
      email: 'joerg@example.org',
    });
    expect(notify.success).toHaveBeenCalled();
    expect(changed).toBe(1);
    expect(c.mode).toBeNull();
  });

  it('ordnet ein vorhandenes Konto ueber den Benutzernamen zu', () => {
    const { fixture, service } = render();
    const c = fixture.componentInstance;
    c.open('account');
    c.userName = '  vm.kassel ';
    c.addAccount();
    expect(service.addLead).toHaveBeenCalledWith(7, { user_name: 'vm.kassel' });
  });
});
