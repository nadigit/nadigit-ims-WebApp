import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class BackendStatusService {
  private backendUnavailableSubject = new BehaviorSubject<boolean>(false);

  get backendUnavailable$(): Observable<boolean> {
    return this.backendUnavailableSubject.asObservable();
  }

  setBackendUnavailable(unavailable: boolean): void {
    this.backendUnavailableSubject.next(unavailable);
  }
}

