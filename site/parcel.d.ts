// Parcel-specific module loaders
declare module 'url:*' {
  const url: string
  export default url
}

// Parcel inlines process.env.NODE_ENV at build time. App.tsx had a local
// declaration for this; hoisting it here keeps any module able to use it.
declare const process: { env: Record<string, string | undefined> }
