import cwf, { Cwf } from './index';

describe('cwf', () => {
  it('should create', () => {
    const app = cwf();
    expect(app).toBeInstanceOf(Cwf);
    app.destroy();
  });

  it('should render views', async () => {
    const app = cwf();
    app.listen();

    const errPage = await fetch('http://127.0.0.1:3000/404');
    expect(await errPage.text()).toBe('404');
    app.destroy();
  });
});
