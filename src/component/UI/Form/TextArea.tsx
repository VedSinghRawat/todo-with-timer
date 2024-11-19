import { FC, HTMLAttributes, RefObject, memo } from 'react'
import formControlled from '../../../HOC/formControlled'

interface TextAreaProps extends HTMLAttributes<HTMLTextAreaElement> {
  innerRef?: RefObject<HTMLTextAreaElement>
  children?: string
  name?: string
}

const TextAreaComp: FC<TextAreaProps> = ({ className = '', name, innerRef, onInput, children, ...rest }) => {
  return (
    <>
      {children && <label htmlFor={name}>{children}</label>}

      <textarea
        id={name}
        ref={innerRef}
        onInput={(event) => {
          onInput && onInput(event)

          const textAreaRef = event.currentTarget
          textAreaRef.style.height = 'auto'
          textAreaRef.style.height = textAreaRef.scrollHeight.toString() + 'px'
        }}
        className={`overflow-hidden p-1 px-2 mt-1.5 w-full font-medium bg-opacity-60 rounded-sm border backdrop-blur-sm outline-none resize-none focus:border-secondary-8 border-secondary-7 placeholder-secondary-11 text-secondary-12 placeholder-opacity-55 bg-secondary-3 ${className}`}
        {...rest}
      />
    </>
  )
}

export const TextArea = memo(TextAreaComp)
export default formControlled(TextArea)
