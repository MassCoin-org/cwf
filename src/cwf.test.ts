import cwf, { Cwf } from './index';

const app = cwf();

describe('cwf', () => {
  it('should create', () => {
    expect(app).toBeInstanceOf(Cwf);
  });

  it('should render views', async () => {
    app.listen(4040);

    const errPage = await fetch('http://127.0.0.1:4040/404');
    expect(await errPage.text()).toBe('404');
  });
});
