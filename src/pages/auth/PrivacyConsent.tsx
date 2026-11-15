import type { ComponentPropsWithRef } from 'react'
import { Link } from 'react-router'
import { Checkbox } from '@/components/ui/Checkbox'
import { PRIVACY_PATH } from '@/lib/privacy'
import { linkClass } from './links'

type Props = Omit<ComponentPropsWithRef<'input'>, 'type' | 'id'> & { error?: string | undefined }

export function PrivacyConsent({ error, ...rest }: Props) {
  return (
    <Checkbox
      error={error}
      label={
        <>
          Leí y acepto el{' '}
          <Link to={PRIVACY_PATH} target="_blank" className={linkClass}>
            aviso de privacidad
          </Link>
          .
        </>
      }
      {...rest}
    />
  )
}
