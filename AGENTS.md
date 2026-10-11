<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- AccelX is a single-route UI-only app: state lives in a zustand store persisted to localStorage (skipHydration, rehydrated in an effect) to avoid SSR hydration mismatches.
- Curve math lives in pure functions in src/lib/curve.ts so a native engine can reuse it; native calls are stubs in src/lib/native.ts.
- Graph viewport and range settings are presentation-only state, with pure axis-space math in src/lib/graphView.ts; zoom and pan must never modify engine points or their history.
- Browser previews center a wrapper sized to the scaled desktop window, with the fixed-size window transformed from its top-left origin; this keeps the desktop layout visible on small preview screens without changing native sizing.
