import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { RequestForm } from '../../components/hospital/RequestForm.jsx';

export function CreateRequestPage() {
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  const handleCreate = async (payload) => {
    const data = await requestsApi.createRequest(payload);
    setResult(data);
    if (data && data.request) {
      navigate(`/hospital/requests/${data.request.id}`);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Create Emergency Request</h2>
        <Link to="/hospital/requests" className="btn btn-secondary">
          Back to My Requests
        </Link>
      </div>

      <div className="disclaimer-box">
        This posts an emergency coordination request for red cells to verified participating blood banks. It is a sourcing coordination tool, not a laboratory order.
      </div>

      {result && result.request && (
        <div className="form-success" role="status">
          Emergency Request #{result.request.id} created successfully. {result.broadcast?.bankCount || 0} participating blood bank(s) notified.
        </div>
      )}

      <div className="card">
        <h3>Emergency Red-Cell Details</h3>
        <RequestForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
