'use client'

import { useCallback, useEffect, useState } from 'react'
import OrganizationPage from '@/components/OrganizationPage'
import Skeleton from '@/components/Skeleton'
import { getOrganizationData } from '@/lib/sheets'
import { supabase } from '@/lib/supabase'

export default function OrganizationRoutePage() {
  const [data, setData] = useState(null)
  const [currentMember, setCurrentMember] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: { user } }, organization] = await Promise.all([
        supabase.auth.getUser(),
        getOrganizationData(),
      ])
      setData(organization)
      setCurrentMember(organization.members.find(member => member.auth_id === user?.id) || null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  if (loading || !data) return <Skeleton />
  return <OrganizationPage data={data} currentMember={currentMember} onRefresh={loadData} />
}
