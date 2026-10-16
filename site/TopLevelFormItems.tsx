import { NO_AUTOFILL } from './utils'

export function TopLevelFormInput(props: any) {
  return (
    <>
      <label htmlFor={props.id} className="top-level form-label">
        {props.name}
      </label>
      <input
        className="top-level input"
        id={props.id}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        type={props.type}
        autoFocus={props.autoFocus}
        // The login form uses this input too: let password managers fill
        // the password, and keep them out of every other field.
        {...(props.type === 'password' ? { autoComplete: 'current-password' } : NO_AUTOFILL)}
      />
    </>
  )
}

export function TopLevelFormTextArea(props: any) {
  return (
    <>
      <label htmlFor={props.id} className="top-level form-label">
        {props.name}
      </label>
      <textarea
        id={props.id}
        className={'top-level textarea input'}
        value={props.value}
        onChange={props.onChange}
      ></textarea>
    </>
  )
}

export function TopLevelFormContainer(props: any) {
  return <div>{props.children}</div>
}
