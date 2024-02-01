// Install necessary packages
// npm install @apollo/client graphql

import React, { useState, useEffect } from 'react';
import { ApolloClient, InMemoryCache, ApolloProvider, useQuery, gql } from '@apollo/client';

const token = process.env.REACT_APP_GITHUB_PAT;
const enterprise_name = process.env.REACT_APP_GITHUB_ENTERPRISE_NAME;

// Initialize Apollo Client
const client = new ApolloClient({
  uri: 'https://api.github.com/graphql',
  headers: {
    Authorization: token ? `Bearer ${token}` : "",
  },
  cache: new InMemoryCache()
});

const ORGS_QUERY = gql`
query ($enterprise: String! $cursor: String) {
  enterprise(slug:$enterprise) {
    name
    organizations(first: 100 after:$cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        login
        id
      }
    }
  }
}
`;

const MIGRATIONS_FILTER_QUERY = gql`
query getMigrations($before: String, $orgId: ID!, $state: MigrationState!) {
  node(id: $orgId) {
    ... on Organization {
      repositoryMigrations(before: $before, state: $state, last: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          id
          createdAt
          failureReason
          repositoryName
          state
          migrationLogUrl
        }
        pageInfo {
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  }
}
`

function OrgList() {
  const { loading: orgLoading, error: orgError, data: orgData } = useQuery(ORGS_QUERY, {
    variables: { enterprise: enterprise_name, cursor: null },
  });

  const [selectedOrgId, setSelectedOrgId] = useState('');

  const [migrationState, setMigrationState] = useState('IN_PROGRESS');

  const [cursor, setCursor] = useState(null);

  const { loading: migrationLoading, error: migrationError, data: migrationData, refetch: refetchMigrations } = useQuery(MIGRATIONS_FILTER_QUERY, {
    variables: { orgId: selectedOrgId, state: migrationState, before: cursor },
    skip: !selectedOrgId,
  });

  useEffect(() => {
    if (selectedOrgId) {
      refetchMigrations({ orgId: selectedOrgId });
    }
  }, [selectedOrgId, refetchMigrations]);

  
  if (migrationError) console.log(migrationError);
  if (orgError) console.log(orgError);

  if (orgLoading || migrationLoading) return <p>Loading...</p>;
  if (orgError || migrationError) return <p>Error :(</p>;

  return (
    <div>
      <div>
        <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
          {orgData.enterprise.organizations.nodes.map(({ id, login }) => (
            <option key={id} value={id}>
              {login}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label>
          <input 
            type="radio" 
            value="IN_PROGRESS" 
            checked={migrationState === 'IN_PROGRESS'} 
            onChange={() => {setMigrationState('IN_PROGRESS'); setCursor(null);}} />
          In Progress
        </label>
        <label>
          <input type="radio" value="QUEUED" checked={migrationState === 'QUEUED'} onChange={() => { setMigrationState('QUEUED'); setCursor(null);}} />
          Queued
        </label>
        <label>
          <input type="radio" value="SUCCEEDED" checked={migrationState === 'SUCCEEDED'} onChange={() => { setMigrationState('SUCCEEDED'); setCursor(null);}} />
          Succeeded
        </label>
        <label>
          <input type="radio" value="FAILED" checked={migrationState === 'FAILED'} onChange={() => { setMigrationState('FAILED'); setCursor(null);}} />
          Failed
        </label>
      </div>
      <div>
        {migrationData && migrationData.node.repositoryMigrations.pageInfo.hasPreviousPage && (
          <button onClick={() => setCursor(migrationData.node.repositoryMigrations.pageInfo.startCursor)}>
            Load Prior
          </button>
        )}
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }} >Repository Name</th>
              <th style={{ textAlign: 'left' }} >Created At</th>
              <th style={{ textAlign: 'left', padding: '0 15px' }} >State</th>
              {migrationState === 'FAILED' && <th style={{ textAlign: 'left', padding: '0 15px' }} >Failure Reason</th>}
            </tr>
          </thead>
          <tbody>
            {migrationData && migrationData.node.repositoryMigrations.nodes.map(({ id, repositoryName, createdAt, state, failureReason }) => (
              <tr key={id}>
                <td>{repositoryName}</td>
                <td>{formatDate(createdAt)}</td>
                <td style={{ padding: '0 15px' }} >{state}</td>
                {migrationState === 'FAILED' && <td style={{ padding: '0 15px' }} >{failureReason}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

// Wrap the app with ApolloProvider
function App() {
  return (
    <ApolloProvider client={client}>
      <OrgList />
    </ApolloProvider>
  );
}

export default App;