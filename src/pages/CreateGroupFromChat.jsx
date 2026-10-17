import { Navigate, useParams } from 'react-router-dom'

// "Create group" from a chat now uses the same steps as a new community, with that person already chosen.
export default function CreateGroupFromChat() {
  const { userId } = useParams()
  return <Navigate to={`/communities/create?with=${userId}`} replace />
                                                   }
