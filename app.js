(function() {

  return {
    events: {
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      'click #new-linked-ticket'        : 'displayForm',
      'click #create-linked-ticket'     : 'create',
      'createTicket.done'               : 'createTicketDone',
      'createTicket.fail'               : 'createTicketFail'
    },

    requests: {
      createTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: ticket,
          type: 'POST'
        };
      },
      updateTicket: function(data){
        return {
          url: '/api/v2/tickets/'+ this.ticket().id() +'.json',
          dataType: 'json',
          data: data,
          type: 'PUT'
        };
      }
    },

    onActivated: function(data) {
      this.doneLoading = false;

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
        !!_.isEmpty(this.ticket().id())){

        var tmpl = 'home';

        if(!_.isEmpty(this._childID()))
          tmpl = 'child_is_present';

        this.switchTo(tmpl);
      }
    },

    displayForm: function(event){
      event.preventDefault();

      this.switchTo('form');
    },

    create: function(event){
      event.preventDefault();

      if (this.validate())
        this.ajax('createTicket', this._newTicketAsJson());
    },

    validate: function(){
      var fields = [ 'subject','description'],
        isValid = true;

      _.each(fields, function(field){
        isValid = this._validateField(field, isValid);
      }, this);

      return isValid;
    },

    createTicketDone: function(data){
      this.ticket().customField("custom_field_" + this.settings.child_id,
                                data.ticket.id
                               );
      var fields = {};

      fields[this.settings.child_id] = data.ticket.id;

      this.ajax('updateTicket', { "ticket": { "fields": fields }});

      this.switchTo('child_is_present');
    },

    createTicketFail: function(data){
      // TODO: WARN ON FAILURE
    },
    // Helper methods (get/set...)
    _validateField: function(field){
      var fieldSelector = '#' +field,
      valid = false;

      if (_.isEmpty(this.$(fieldSelector).val())){
        this.$(fieldSelector).parent('.control-group').addClass('error');
      } else {
        this.$(fieldSelector).parent('.control-group').removeClass('error');
        valid = true;
      }
      return valid;
    },
    _newTicketAsJson: function(){
      var params = {
        "subject": this.$('#subject').val(),
        "description": this.$('#subject').val()
      };

      if (this.$('#copy_requester').is(':checked'))
        params.requester_id = this.ticket().requester().id();

      if (this.$('#copy_description').is(':checked'))
        params.description += '\n--- Original Description --- \n' + this.ticket().description();

      return { "ticket": params };
    },
    _childID: function(){
      return this.ticket().customField("custom_field_" + this.settings.child_id);
    }
  };
}());
