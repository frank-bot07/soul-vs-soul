export class NormalizedScore {
  readonly value: number;

  constructor(raw: number) {
    if (!Number.isFinite(raw)) {
      this.value = 0;
      return;
    }
    this.value = Math.max(0, Math.min(100, Math.round(raw)));
  }
}
