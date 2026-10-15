import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'

// Every nick is a type letter and six digits: n (note), w (work),
// i (idea), p (pile).
const NICK_PATTERN = /^[nwip]\d{6}$/

function NickView(props: any) {
  const { nick } = useParams()
  const navigate = useNavigate()
  const { setPageTitle } = props
  const [error, setError] = useState(false)
  // At /:nick any unknown one-segment URL lands here; only nick-shaped
  // ones are looked up.
  const notANick = props.shortUrl && !NICK_PATTERN.test(nick ?? '')

  useEffect(() => {
    let isMounted = true

    const resolveNick = async () => {
      if (!nick || notANick) {
        return
      }
      if (setPageTitle) {
        setPageTitle('Resolving nick')
      }
      try {
        const response = await db.getNick(nick)
        const nickData = response?.data?.data
        if (!nickData) {
          if (isMounted) {
            setError(true)
          }
          return
        }
        // Replace the nick URL in history, so Back from the page doesn't
        // land on the nick URL and redirect forward again.
        switch (nickData.key?.charAt(0)) {
          case 'n':
            navigate('/note/' + nickData.note, { replace: true })
            return
          case 'w':
            navigate('/work/' + nickData.work, { replace: true })
            return
          case 'i':
            navigate('/idea/' + nickData.idea, { replace: true })
            return
          case 'p':
            navigate('/pile/' + nickData.pile, { replace: true })
            return
          default:
            if (isMounted) {
              setError(true)
            }
            return
        }
      } catch (resolveError: any) {
        console.error('Error fetching nick', resolveError)
        if (isMounted) {
          setError(true)
        }
      }
    }

    resolveNick()

    return () => {
      isMounted = false
    }
  }, [nick, navigate, setPageTitle, notANick])

  if (notANick) {
    return <div>Page not found</div>
  }

  if (error) {
    return <div>Nick not found</div>
  }

  return <div>Resolving nick...</div>
}

export default NickView
