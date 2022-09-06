import cwf from "./index";
import { CwfRequest } from "./CwfRequest";

const app = cwf({ debug: true });

app.handleRoute(
  "/",
  (req: CwfRequest, _, renderView: (viewName?: string) => void) => {
    //const formattedCookies = JSON.stringify(req.cookies, null, 4);

    //console.log(`CookiesT-S: ${formattedCookies}`);
    renderView();
  }
);

app.listen(3000);
