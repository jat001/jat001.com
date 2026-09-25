import { markdownPathname, wantsMarkdown } from '../../src/lib/markdown.ts';

interface NextOptions {
  sendConditionalRequest?: boolean;
}
interface Context {
  next(options?: NextOptions): Promise<Response>;
  next(request: Request, options?: NextOptions): Promise<Response>;
}
const options: NextOptions = { sendConditionalRequest: true };

export default async function index (request: Request, context: Context): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405 });
  }

  const url = new URL(request.url);
  const response = wantsMarkdown(request)
    // The original request must be sent to preserve the request headers when `request` is passed.
    ? await context.next(new Request(url.origin + markdownPathname(url.pathname), request), options)
    // The original request headers will be automatically inherited when `request` is not passed.
    : await context.next(options);
  response.headers.set('Vary', 'Accept');
  return response;
};
