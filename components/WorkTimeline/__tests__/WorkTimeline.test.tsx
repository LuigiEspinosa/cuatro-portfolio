vi.mock('gsap', () => {
  const gsapMock = {
    context: vi.fn((_fn: (ctx: unknown) => void) => {
      _fn({});
      return { revert: vi.fn() };
    }),
    to: vi.fn(),
    set: vi.fn(),
    fromTo: vi.fn(),
    registerPlugin: vi.fn(),
  };
  return {
    gsap: gsapMock,
    default: gsapMock,
  };
});
