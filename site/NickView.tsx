import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as db from './Database'

function NickView(props: any) {
  const { nick } = useParams()
  const navigate = useNavigate()
  const { setPageTitle } = props
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true

    const resolveNick = async () => {
      if (!nick) {
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
        switch (nickData.key?.charAt(0)) {
          case 'n':
            navigate('/note/' + nickData.note)
            return
          case 'w':
            navigate('/work/' + nickData.work)
            return
          case 'i':
            navigate('/idea/' + nickData.idea)
            return
          case 'p':
            navigate('/pile/' + nickData.pile)
            return
          default:
            if (isMounted) {
              setError(true)
            }
            return
        }
      } catch (resolveError) {
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
  }, [nick, navigate, setPageTitle])

  if (error) {
    return <div>Nick not found</div>
  }

  return <div>Resolving nick...</div>
}

export default NickView
